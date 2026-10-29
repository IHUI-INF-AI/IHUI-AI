#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 守门:暂存删除的存续性对账(blocking)—— `scripts/check-staged-deletions.mjs`
 *
 * 拦的是什么:多会话共享同一 gitdir 时,宿主清理层成批删除工作区里已跟踪的文件,而某些
 * 路径会把这些删除**暂存进索引**(状态 `D `)。后果是任何人跑一次不带 pathspec 的普通
 * `git commit`,就把这些已入库的功能与测试从版本树里删掉 —— 一次静默回滚。
 *
 * 为什么已有机制看不见它:
 *   · `scripts/heal-worktree-tracked.mjs` 的恢复判据②要求"索引 blob == HEAD blob",
 *     暂存删除让该条件不成立,于是它按设计"只报数、不代裁";
 *   · 守门 65(check-mass-deletion)只看删除**规模**(≥1000 个或 ≥20%),十几条精准打击全放过。
 *   缺的大概就是这个特例:删除规模不大、但仓库仍在引用它。
 *
 * 判"误删"还是"有意删除"的可核验依据(两条同时成立才判红):
 *   E1 引用仍在 —— 索引里(不是工作区)仍有别的跟踪文件引用该路径,覆盖三种形态:
 *      ① 相对 import / require / dynamic import / barrel 的 `export * from`(按候选集精确解析);
 *      ② 别名路径(`@/…`、`@ihui/…`)末段同名且父目录名对得上;
 *      ③ 整仓库相对路径字面量(别的守门清单、tsconfig include 等)。
 *   E2 无替代路径 —— 同名同后缀的文件在索引里不存在于任何其他目录(即没人把它搬到别处)。
 *   E3 测试删除的意向声明(2026-10-27 补,治"删测试永远判绿")—— E1 的证据是"索引里还有别的
 *      文件引用它",而**测试文件天然不被任何生产文件 import**,于是 E1 对它们结构上恒不成立:
 *      一枚按旧基线写回的提交(`b966cb21676`)静默删掉 4 个测试文件时,本门报绿。E3 因此换取证
 *      方向 —— 从**被删测试自己的内容**里解析它测的是谁:import/require/import() 说明符解析成
 *      仓库路径后,只要那个源模块**在索引面仍然存在**、且**本笔提交没有同时删掉/搬走它**,这条
 *      删除就丢掉了"意向",判红。三条放过通道(任一即可)见下方 `auditTestDeletions`。
 *   歧义放过对**三种形态同一条判据**(2026-09-29 补,此前只做在①上):本仓 ESM 约定里 `./x.js`
 *   指的是 `x.ts`,所以删 `X.js` 而同目录 `X.ts` 仍在审面时,②③ 的引用并未断 —— 缺这一层,本门会
 *   把守门 98 D4 影子维规定的正确修法("删掉那份 .js、别去改说明符")判成红,两道门互咬
 *   (实测于 G-815918 那枚删除;成对取证:自检 ㉔/㉕ + 镜像 T11/T12,只留放过那条等于允许
 *   "任何别名引用都放过")。已知代价与①同:同目录那份同 stem 文件若其实是无关模块,本门放过。
 *   只成立一条 → **不计红,但如实报数**(绝不在报告里静默成"看起来全绿")。
 * 反向理由:一次正当的删除,提交者通常会**同时改掉引用它的地方** —— 引用方自己也一起删,
 * 正是本门放行的形态(自检第②例 + 镜像测试的临时仓端到端各钉了一条正向对照)。
 *
 * 口径:一律判**索引 blob**(`git cat-file --batch` 读 `:<path>`),不判滞后的共享工作树
 * (与守门 70/77/83 同取向)。全程只读:不改索引、不改工作区、不写任何文件。
 * 取向:宁漏不误报 —— 误报的红门只会逼人 `--no-verify`,连带废掉全部 100+ 道守门。
 *
 * 用法:
 *   node scripts/check-staged-deletions.mjs                 # 默认 = --staged(pre-commit 口径)
 *   node scripts/check-staged-deletions.mjs --staged        # 只判"已暂存的删除"
 *   node scripts/check-staged-deletions.mjs --all           # 全量审计:暂存删除 + 工作区待删
 *   node scripts/check-staged-deletions.mjs --json          # 机器可读输出
 *   node scripts/check-staged-deletions.mjs --self-test     # 逻辑自检(正反例成对,纯内存不碰真仓)
 *   node scripts/check-staged-deletions.mjs --root <dir>    # 测试通道:显式指定仓库根(生产不带,语义不变)
 *   node scripts/check-staged-deletions.mjs --allowlist <f> # 测试通道:显式指定豁免清单
 *   node scripts/check-staged-deletions.mjs --message <t>   # E3 通道②:显式给本次提交信息
 *   node scripts/check-staged-deletions.mjs --message-file <f> # E3 通道②:从文件读提交信息(commit-msg 阶段)
 * 豁免清单:`scripts/staged-deletions-allowlist.json`(不存在时正常工作,不作为判据失效)
 *   { "paths": [ "a/b.ts", { "path": "c/d.ts", "reason": "已迁到 e/f.ts", "ticket": "G-1", "until": "2026-12-31" } ] }
 *   `until` 只对 E3(测试删除)生效且过期即失效:E1/E2 的既有语义**冻结不动**(不在本票射程);
 *   这样"测试文件删除"这一档的豁免会到期,不会变成登记一次永久免检。
 * 应急跳过:HUSKY_SKIP_STAGED_DELETIONS=1 git commit ...
 * 退出码:0 通过 / 1 违规 / 2 脚本自身异常或 E3 判据"未判定"(异常绝不静默放行)
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
// git 派生与 `cat-file --batch` 取材一律走共用层 scripts/lib/face-reader.mjs(绝对路径 git、
// safe.directory、quotepath、显式 stdio、批量读)。本门不再自带 `gitOut()` / 那份 batch 解析器。
import { Undetermined, catBatch, catBatchOids, gitRaw } from './lib/face-reader.mjs'
import { requireFlagValue } from './lib/flag-value.mjs'
// E3 的三条放过通道里有两条是**别人已经定义好的语义**,不许在本门再抄一份字面量:
//   · `intentional-delete:` 短语单源住 lib/deletion-intent.mjs(守门 168 同源);
//   · `--cached -M` 的改名对拆帧单源住 lib/git-paths.mjs(那里专门记过"一状态两路径"的帧形坑)。
import { hasIntentionalMarker } from './lib/deletion-intent.mjs'
import { gitStagedRenamePairs } from './lib/git-paths.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const SELF_SKIP = 'HUSKY_SKIP_STAGED_DELETIONS'
const ALLOWLIST_REL = 'scripts/staged-deletions-allowlist.json'
/** 与层的默认上限同值(60s),显式写出来是为了让 grep 的"零命中 vs 超时"判据能拿到同一个数 */
const GIT_TIMEOUT = 60000
const GREP_BATCH = 60
/** 全局候选文件数超过该上限 → 改按单个名字分别取候选(精确度优先于一次派生) */
const GLOBAL_CAND_LIMIT = 1500
/** 短于此长度的名字(如 `a.ts`)全仓子串命中量巨大且必然撞名 → 不判,如实报数 */
const MIN_STEM = 4
/** 单个名字的候选数超上限 → 判据过宽,不判红(宁漏) */
const MAX_CANDIDATES = 2000
/** 删除面超上限 → 那是守门 65(整树删除拦截)的地盘,本门只报数不判红,免得 pre-commit 卡死 */
const MAX_DELETED_JUDGED = 400
/**
 * E3:测试文件命名(射程)。三族并列,任一命中即算"测试件":
 *   ① `tests/` `test/` `__tests__/` 目录;② `*.test.*`;③ `*.spec.*`。
 * 为什么要单列射程而不是"所有删除":E1 的证据是"还有别的文件引用它"(见文件头 E3 条),
 * 对生产文件成立、对测试件结构上恒不成立 —— 两者需要的证据方向相反,不能混用同一把尺子。
 */
const TEST_FILE_RE = /(^|\/)(tests?|__tests__)\/|\.(test|spec)\.[cm]?[jt]sx?$/i
/** `import … from 'x'` / `export … from 'x'` / 副作用 import / require() / import() —— 只认这几形态 */
const SPEC_PATTERNS = [
  /\bfrom\s*(['"])([^'"\n]{1,300})\1/g,
  /(?:^|[^\w.$])import\s+(['"])([^'"\n]{1,300})\1/g,
  /\brequire\s*\(\s*(['"])([^'"\n]{1,300})\1\s*\)/g,
  /\bimport\s*\(\s*(['"])([^'"\n]{1,300})\1\s*\)/g,
]
/** E3 通道③"同内容搬走"的比对上限:新增件过多时不做内容比对(宁漏,别让 pre-commit 卡死) */
const ADDED_OID_LIMIT = 500

const SRC_EXT = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']
/** 可作"引用方"的文件类型:代码 + 配置。`.md`/`.txt` 里提到某路径是叙述,不是依赖。 */
const REF_EXT = /\.(ts|tsx|js|jsx|mjs|cjs|json|py|html|htm|vue|svelte)$/i
/** 夹具与产物目录不得算引用方(样例/再生成物,不是仓库对该文件的依赖) */
const REF_EXCLUDE =
  /(^|\/)(node_modules|dist|build|out|coverage|\.next|\.expo|\.turbo|\.cache|\.venv|venv|site-packages|android|ios|tmp|temp|logs|downloads|output|testdata|fixtures|__fixtures__|__mocks__|benchmarks?|\.ihui-agent|\.workbuddy)\//
/** 记账类 JSON(baseline / allowlist / report):里面出现某路径只是历史计数 */
const ACCOUNTING = /(^|\/)[^/]*(baseline|allowlist|report)[^/]*\.json$/i
/** 生成物:重新生成即恢复,不作为存续性证据 */
const GENERATED = /(\.gen|\.generated)\.[cm]?[jt]sx?$/i
const KNOWN_EXT =
  /\.(ts|tsx|js|jsx|mjs|cjs|json|css|scss|less|html|vue|svelte|svg|png|jpe?g|gif|webp|md)$/i

// ── 纯函数:路径解析(不依赖 ROOT / git,测试可直接调用) ────────────────────────────
export function stemOf(p) {
  const b = String(p).split('/').pop() || ''
  const i = b.lastIndexOf('.')
  return i > 0 ? b.slice(0, i) : b
}
export function dirOf(p) {
  const i = p.lastIndexOf('/')
  return i < 0 ? '' : p.slice(0, i)
}
/** posix 风格的相对路径拼接(不能用 node:path#resolve:Windows 会换成反斜杠 + 盘符) */
export function joinRel(fromDir, spec) {
  const raw = spec.startsWith('.') && fromDir !== '' ? `${fromDir}/${spec}` : spec
  const out = []
  for (const seg of raw.split('/')) {
    if (!seg || seg === '.') continue
    if (seg === '..') {
      if (!out.length) return null // 逃出仓库根:不是仓内引用,不判
      out.pop()
      continue
    }
    out.push(seg)
  }
  return out.join('/')
}
/** 一个模块说明符可能解析到的候选路径(tsc / Metro 的解析顺序) */
export function moduleCandidates(rel) {
  const clean = rel.split('?')[0]
  if (!clean) return []
  const out = []
  if (KNOWN_EXT.test(clean)) {
    out.push(clean)
    // TS 里写 `./x.js` 指 `x.ts` 是本仓常见形态:两种候选都要给,否则歧义判据会误放过/误判
    const noJs = clean.replace(/\.[cm]?[jt]sx?$/, '')
    if (noJs && noJs !== clean) out.push(`${noJs}.ts`, `${noJs}.tsx`)
  } else {
    out.push(...SRC_EXT.map((e) => clean + e), clean)
  }
  out.push(...SRC_EXT.map((e) => `${clean}/index${e}`))
  return [...new Set(out)]
}
/** 剥整行注释:JSDoc 示例、被注掉的旧导入都不是引用。`#` 只对脚本类语言剥(避免吃掉 JS 私有字段行)。 */
export function codeLines(text, file) {
  const hashComment = /\.(py|sh|ya?ml|toml|rb)$/i.test(file)
  return text
    .split('\n')
    .map((l, i) =>
      /^\s*(\/\/|\*|\/\*|-->)/.test(l) || (hashComment && /^\s*#/.test(l)) ? '' : `${i + 1}\t${l}`,
    )
    .filter(Boolean)
    .join('\n')
}
/** 逐行抽取引号内的字符串(带行号,便于报告点名) */
export function extractStrings(text, file) {
  const out = []
  for (const line of codeLines(text, file).split('\n')) {
    const tab = line.indexOf('\t')
    if (tab < 0) continue
    const no = Number(line.slice(0, tab))
    const body = line.slice(tab + 1)
    for (const m of body.matchAll(/(['"`])((?:\\.|(?!\1)[^\n\\]){0,300})\1/g))
      out.push({ no, s: m[2] })
  }
  return out
}
/**
 * 同目录、同 stem、另一已知扩展名的那份**还活在审面上**吗?
 * 本仓 ESM 约定:源码里写 `./x.js` 指的其实是 `x.ts`(守门 98 的 D4 影子维就规定"删掉那份 .js、
 * 别去改说明符")。所以删 `X.js` 而 `X.ts` 在位时,任何指向这一模块族的引用**并没有断** ——
 * 别名/路径字面量这两个形态原先缺这一层判据,于是门 99 会把门 98 规定的正确修法拦下来(两道门互咬)。
 * 代价如实登记(与相对形态同一条已知取舍):若同目录那份同 stem 文件其实是**无关模块**,本门会放过。
 */
export function altSiblingsAlive(p, liveSet) {
  if (!liveSet) return false
  const dir = dirOf(p)
  const stem = stemOf(p)
  return SRC_EXT.some((e) => {
    const cand = dir ? `${dir}/${stem}${e}` : `${stem}${e}`
    return cand !== p && liveSet.has(cand)
  })
}
/**
 * 说明符形态判定(见文件头 E1 三种形态)。`liveSet` 供歧义判据用。
 * 歧义一律放过:相对说明符的候选集里还有**别的**现存文件 ⇒ 它未必指向 P。
 */
export function classifySpecifier(spec, file, p, liveSet) {
  if (!spec || spec.length > 300) return null
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(spec) || spec.startsWith('//')) return null // URL / 协议相对
  const bare = spec.split('?')[0].split('#')[0]
  if (!bare) return null
  if (bare.startsWith('.')) {
    const joined = joinRel(dirOf(file), bare)
    if (!joined) return null
    const cands = moduleCandidates(joined)
    if (!cands.includes(p)) return null
    if (liveSet && cands.some((x) => x !== p && liveSet.has(x))) return null
    return { kind: 'relative', spec }
  }
  if (!bare.includes('/')) return null // 裸包名(`react`):太糊,一律不判
  const tail = bare.split('/').filter(Boolean).pop() || ''
  if (stemOf(tail) !== stemOf(p)) return null
  // 别名与整仓库路径字面量这两个形态也必须走同一条"歧义放过":同 stem 的另一份实现还在审面上
  // ⇒ 引用没断(门 98 D4 规定的正确修法正是删掉这一份)。缺这一层就会与门 99 互咬。
  if (altSiblingsAlive(p, liveSet)) return null
  if (bare === p || bare.replace(/^\//, '') === p) return { kind: 'path-literal', spec }
  const segs = bare.split('/').filter(Boolean)
  const parent = dirOf(p).split('/').filter(Boolean).pop()
  if (!parent) return null
  // 别名形态额外要求 P 的父目录名出现在说明符里 —— 专门拦掉 `react/jsx-runtime` 这类同名外部包
  if (segs.slice(0, -1).includes(parent)) return { kind: 'alias', spec }
  return null
}
/**
 * 反向索引一次扫完所有待删路径(旧写法按"每个待删路径 × 全部候选文件"重复解析,
 * 删除面一大就是 O(D×C) 的 pre-commit 卡顿;现按说明符末段名字分桶,每个候选文件只解析一次)。
 * `candSets` 限定"某个待删路径允许被哪些文件引用"(候选面按名字分别取时不同)。
 */
export function collectHits(deletedPaths, candidates, readFile, liveSet, candSets = null) {
  const byStem = new Map()
  for (const p of deletedPaths) {
    const s = stemOf(p)
    if (!byStem.has(s)) byStem.set(s, [])
    byStem.get(s).push(p)
  }
  const hits = new Map()
  const done = new Set()
  for (const f of candidates) {
    if (done.has(f)) continue
    done.add(f)
    const text = readFile(f)
    if (!text) continue // 取不到内容 = 不判(宁漏不误报)
    for (const { no, s } of extractStrings(text, f)) {
      const bare = String(s).split('?')[0].split('#')[0]
      if (!bare || bare.length > 300) continue
      let key = null
      if (bare.startsWith('.')) {
        const joined = joinRel(dirOf(f), bare)
        if (!joined) continue
        key = stemOf(joined)
      } else {
        if (!bare.includes('/')) continue // 裸包名:太糊,一律不判
        key = stemOf(bare.split('/').filter(Boolean).pop() || '')
      }
      const list = byStem.get(key)
      if (!list) continue
      for (const p of list) {
        if (p === f) continue
        if (candSets && !candSets.get(p)?.has(f)) continue
        if ((hits.get(p) || []).some((h) => h.file === f)) continue // 每个引用方只记一条
        const c = classifySpecifier(s, f, p, liveSet)
        if (!c) continue
        if (!hits.has(p)) hits.set(p, [])
        hits.get(p).push({ file: f, line: no, form: c.kind, spec: s })
      }
    }
  }
  return hits
}
/** 单路径版(与 collectHits 同一条判据,不自成一派) */
export function referencesFor(p, candidates, readFile, liveSet) {
  return collectHits([p], candidates, readFile, liveSet).get(p) || []
}
/** 豁免条目匹配:整路径精确 / 目录前缀 `x/**` / 目录前缀 `x/`。 */
export function matchAllowlist(p, entries) {
  for (const e of entries) {
    if (!e.pattern) continue
    if (e.pattern.endsWith('/**') && p.startsWith(e.pattern.slice(0, -3))) return e
    if (e.pattern.endsWith('/') && p.startsWith(e.pattern)) return e
    if (e.pattern === p) return e
  }
  return null
}
export function normEntry(p) {
  return String(p).replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\//, '')
}
/** 豁免清单解析。raw 为 null = 文件不存在(合法);坏 JSON **绝不**当作空清单静默放过,必须带出错误。 */
export function parseAllowlist(raw, sourceName) {
  if (raw === null || raw === undefined) return { entries: [], parseError: null, missing: true }
  let obj
  try {
    obj = JSON.parse(String(raw).replace(/^\uFEFF/, '')) // BOM(Windows 编辑器常见)不得让整份清单失效
  } catch (e) {
    return {
      entries: [],
      parseError: `${sourceName} JSON 解析失败(${e?.message || e}),本次按空清单执行(不因此放行任何一条)`,
      missing: false,
    }
  }
  const list = Array.isArray(obj) ? obj : Array.isArray(obj?.paths) ? obj.paths : []
  const entries = []
  // `ticket` / `until` 是**只增不改**的两个字段(AGENTS 里那套豁免台账的通用形状):E1/E2 不读它们
  // ⇒ 既有语义逐字不动;E3 读 `until` 是为了让"测试删除"这一档的豁免会到期(§0.7)。
  const normUntil = (v) => {
    const s = typeof v === 'string' ? v.trim() : ''
    return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null
  }
  for (const it of list) {
    if (typeof it === 'string' && it.trim())
      entries.push({ pattern: normEntry(it), reason: '', ticket: null, until: null, untilRaw: null })
    else if (it && typeof it.path === 'string' && it.path.trim())
      entries.push({
        pattern: normEntry(it.path),
        reason: String(it.reason || '(清单未写 reason)'),
        ticket: typeof it.ticket === 'string' && it.ticket.trim() ? it.ticket.trim() : null,
        until: normUntil(it.until),
        // 写了 until 却读不成日期 ⇒ E3 **不认**这条豁免(证明不了在有效期内就不免,§0.7);
        // 保留原文只为在报告里点名"写坏的是哪一条",绝不静默当成"永久有效"。
        untilRaw: it.until === undefined || it.until === null ? null : String(it.until),
      })
  }
  return { entries, parseError: null, missing: false }
}
/**
 * 核心判据(纯函数,CLI 与自检共用同一条判据 —— 不设"测试专用宽松版")。
 * deleted        : 待判定的删除路径数组(仓库相对,posix 分隔)
 * livePaths      : 索引中仍然存续的跟踪文件集合(已不含任何暂存删除)
 * readFile(path) : 引用方内容(索引 blob),取不到返回 null
 * getCandidates(stem) : 该名字可能的引用方(CLI 由 `git grep --cached` 提供)
 * allow          : parseAllowlist().entries
 * pendingRemoval : --all 模式下"自己也待删"的路径集合(引用方一起消失 ⇒ 放过)
 */
export function auditDeletions(
  deleted,
  { livePaths, readFile, getCandidates, allow = [], pendingRemoval = new Set() },
) {
  const liveSet = new Set(livePaths)
  const key = (p) => `${stemOf(p)}\u0000${p.includes('.') ? p.split('.').pop() : ''}`
  // 同名同后缀索引一次建好:旧写法每个待删路径线性扫全索引,D 一大就是 O(D×L)
  const byKey = new Map()
  for (const x of liveSet) {
    const k = key(x)
    if (!byKey.has(k)) byKey.set(k, [])
    byKey.get(k).push(x)
  }
  const scaleHit = deleted.length > MAX_DELETED_JUDGED
  const prelim = deleted.map((p) => {
    const rec = { path: p, stem: stemOf(p), verdict: 'clean', hits: [], note: '' }
    if (scaleHit) {
      rec.verdict = 'undetermined'
      rec.note = `删除面 ${deleted.length} 条超过本门判据上限 ${MAX_DELETED_JUDGED}(整树删除由守门 65 负责),不计红只报数`
      return { rec, candidates: null }
    }
    const a = matchAllowlist(p, allow)
    if (a) {
      rec.verdict = 'allowlisted'
      rec.note = a.reason || '(清单未写 reason)'
      return { rec, candidates: null }
    }
    // E2 无替代路径:同名同后缀的文件出现在别的目录 ⇒ 视为已迁移,不计红
    const alt = (byKey.get(key(p)) || []).filter((x) => dirOf(x) !== dirOf(p))
    if (alt.length) {
      rec.verdict = 'alternative-path'
      rec.note = `同名文件仍在 ${alt.slice(0, 3).join(', ')}${alt.length > 3 ? ` 等 ${alt.length} 处` : ''}`
      return { rec, candidates: null }
    }
    if (rec.stem.length < MIN_STEM) {
      rec.verdict = 'undetermined'
      rec.note = `名字过短(<${MIN_STEM}),全仓子串命中不可判定`
      return { rec, candidates: null }
    }
    const raw = getCandidates(rec.stem) || []
    rec.candidates = raw.length
    if (raw.length > MAX_CANDIDATES) {
      rec.verdict = 'undetermined'
      rec.note = `候选引用方 ${raw.length} 个,超过 ${MAX_CANDIDATES} 上限,不判红`
      return { rec, candidates: null }
    }
    const candidates = raw.filter(
      (f) =>
        REF_EXT.test(f) &&
        !REF_EXCLUDE.test(f) &&
        !ACCOUNTING.test(f) &&
        !GENERATED.test(f) &&
        liveSet.has(f),
    )
    rec.ignoredReferrers = raw.length - candidates.length
    return { rec, candidates }
  })
  // E1 引用仍在:把所有待判路径的反查合成一次扫描
  const candSets = new Map()
  const union = new Set()
  for (const { rec, candidates } of prelim) {
    if (!candidates) continue
    candSets.set(rec.path, new Set(candidates))
    for (const f of candidates) union.add(f)
  }
  const hitMap = collectHits([...candSets.keys()], [...union], readFile, liveSet, candSets)
  for (const { rec, candidates } of prelim) {
    if (!candidates) continue
    const hits = (hitMap.get(rec.path) || []).filter((h) => !pendingRemoval.has(h.file))
    if (!hits.length) {
      rec.verdict = 'no-reference'
      rec.note = rec.ignoredReferrers
        ? `另有 ${rec.ignoredReferrers} 处命中落在夹具/产物/记账文件,不计`
        : ''
      continue
    }
    rec.verdict = 'red'
    rec.hits = hits
  }
  return prelim.map((x) => x.rec)
}

// ── E3:测试文件删除的意向声明(纯函数,CLI 与自检共用同一条判据) ──────────────────
/** 路径是否落在测试件射程内(`tests/` `test/` `__tests__/`、`*.test.*`、`*.spec.*`)。 */
export function isTestPath(p) {
  return TEST_FILE_RE.test(String(p).replace(/\\/g, '/'))
}

/**
 * 从被删测试的内容里抽"它测的是谁":只认 import/export-from、副作用 import、require()
 * 与动态 import() —— **不用** `extractStrings` 的"所有引号串":测试里大量断言字面量
 * (`expect(x).toBe('./foo')`),把它们当成依赖会让每一次正当删除都判红(§0.2 误报方向)。
 * 注释行先由 `codeLines` 剥掉(与 E1 同一条实现),于是"被注释掉的旧导入"不算数。
 */
export function extractModuleSpecifiers(text, file) {
  const out = []
  const seen = new Set()
  for (const line of codeLines(text, file).split('\n')) {
    const tab = line.indexOf('\t')
    if (tab < 0) continue
    const no = Number(line.slice(0, tab))
    const body = line.slice(tab + 1)
    for (const re of SPEC_PATTERNS) {
      for (const m of body.matchAll(re)) {
        const spec = m[2]
        if (!spec || spec.length > 300) continue
        const k = `${no}\u0000${spec}`
        if (seen.has(k)) continue
        seen.add(k)
        out.push({ no, spec })
      }
    }
  }
  return out
}

/** 名字 → 索引面路径(别名解析用;别名不带父目录线索,只能按末段名字反查)。 */
export function buildStemIndex(paths) {
  const m = new Map()
  for (const p of paths) {
    const s = stemOf(p)
    if (!m.has(s)) m.set(s, [])
    m.get(s).push(p)
  }
  return m
}

/**
 * 别名说明符(`@/…`、`@ihui/…`)→ 仓库路径。
 * 只在**唯一命中**时返回:E3 的红是"这一步之后没有任何通道",模糊命中就判红等于拿猜测当证据,
 * 与文件头"宁漏不误报"的取向相悖(解析不出来就跳过,报告里如实计入"未解析")。
 */
export function resolveAliasSpec(spec, stemIndex) {
  const s = String(spec)
  let body = s
  if (body.startsWith('@ihui/')) body = body.slice(6)
  else if (body.startsWith('@/')) body = body.slice(2)
  else return []
  const rest = body.split('?')[0].split('#')[0].replace(/^\//, '')
  if (!rest) return []
  const tail = stemOf(rest.split('/').pop() || '')
  if (!tail) return []
  const out = new Set()
  for (const p of stemIndex.get(tail) || []) {
    for (const e of SRC_EXT) {
      if (!p.endsWith(e)) continue
      const base = p.slice(0, p.length - e.length)
      if (base === rest || base.endsWith(`/${rest}`)) out.add(p)
      break
    }
  }
  return out.size === 1 ? [...out] : []
}

/** E3 的豁免匹配:`until` 过期 / 写坏 ⇒ 不认(豁免会到期,§0.7)。 */
export function matchAllowlistLive(p, entries, today) {
  const e = matchAllowlist(p, entries)
  if (!e) return { entry: null, expired: false, note: '' }
  if (e.untilRaw !== null && e.until === null)
    return { entry: null, expired: false, note: `台账条目 until=${JSON.stringify(e.untilRaw)} 读不成日期 ⇒ 不认这条豁免` }
  if (e.until && e.until < today)
    return { entry: null, expired: true, note: `台账条目 until=${e.until} 已过期(${today})⇒ 逾期即失效` }
  return { entry: e, expired: false, note: '' }
}

/**
 * E3 核心判据(纯函数)。输入全部显式给出,故"三条放过通道任一即可"能被构造面逐个证明。
 *
 * `deleted`     : 待判的测试件路径(仓库相对,posix)
 * `readBlob`    : (p) => { text, from } | null —— 被删内容。索引优先、退回 `HEAD:p`;
 *                 两条都取不到 ⇒ undetermined(内容都没有,谈不上"它测的是谁")
 * `renameFrom`  : Map<旧路径, 新路径> | null(null = 该通道本次不可取,报告里会点名)
 * `addedOid` / `deletedOid` : Map<路径, blob oid> | null —— 通道③"同内容搬走"的取证
 * `message`     : 本次提交信息 | null(null = 面不可取,**不等于**"信息里没有标记")
 * `absent`      : 本笔提交里"也一并消失/改名"的路径集合(题二:源模块自己也没了 ⇒ 不红)
 *
 * 红 = 引用到的源模块仍在索引面 ∧ 本笔没删它 ∧ 三条放过通道一条都不成立。
 * 为什么"测试文件自己的夹具/兄弟测试"不算被测模块:删一个测试时它的 helper/fixture 通常照旧
 * 留着(下一次合并测试时更常见),把那些当成"仍有消费者"会让每一次正当的测试合并都判红 ——
 * 而这类红的唯一结局是 `--no-verify`(§12e)。故只认**非测试件**的模块,且沿用 E1 的
 * `REF_EXCLUDE`(夹具/产物目录不是仓库对它的依赖)。
 */
export function auditTestDeletions(deleted, opts = {}) {
  const {
    livePaths = [],
    readBlob = () => null,
    renameFrom = null,
    addedOid = null,
    deletedOid = null,
    allow = [],
    message = null,
    today = new Date().toISOString().slice(0, 10),
    absent = new Set(),
  } = opts
  const liveSet = new Set(livePaths)
  let stemIndex = null
  const recs = []
  for (const p of deleted) {
    const rec = {
      path: p,
      kind: 'E3',
      verdict: 'no-repo-consumer',
      note: '',
      modules: [],
      unresolved: 0,
      channels: { allowlist: false, marker: message === null ? null : false, rename: renameFrom ? false : null, contentMove: addedOid && deletedOid ? false : null },
    }
    recs.push(rec)
    const got = readBlob(p)
    if (!got || typeof got.text !== 'string') {
      rec.verdict = 'test-undetermined'
      rec.note = `被删内容取不到(:${p} 与 HEAD:${p} 都读不出来)⇒ 判不出它测的是谁`
      continue
    }
    const specs = extractModuleSpecifiers(got.text, p)
    const mods = []
    for (const { no, spec } of specs) {
      let cands = null
      if (spec.startsWith('.')) {
        const joined = joinRel(dirOf(p), spec)
        if (!joined) continue
        cands = moduleCandidates(joined).filter((x) => liveSet.has(x))
      } else if (spec.startsWith('@/') || spec.startsWith('@ihui/')) {
        if (!stemIndex) stemIndex = buildStemIndex(livePaths)
        cands = resolveAliasSpec(spec, stemIndex)
        if (!cands.length) rec.unresolved++
      } else continue // 裸包名 / node: 内建:不是仓内模块,不判
      for (const m of cands) {
        if (m === p || absent.has(m)) continue // 题二:本笔自己删/改名的源模块不算"仍在"
        if (isTestPath(m) || REF_EXCLUDE.test(m)) continue // 夹具/兄弟测试不是被测对象
        if (mods.some((x) => x.path === m)) continue
        mods.push({ path: m, spec, line: no, form: spec.startsWith('.') ? 'relative' : 'alias' })
      }
    }
    rec.modules = mods
    rec.specs = specs.length
    if (!mods.length) {
      rec.note = `解析到 ${specs.length} 个说明符,没有一个指向仍在索引面的非测试模块`
      continue
    }
    const al = matchAllowlistLive(p, allow, today)
    rec.channels.allowlist = Boolean(al.entry)
    rec.channels.allowlistNote = al.note
    if (message !== null) rec.channels.marker = hasIntentionalMarker(message)
    const to = renameFrom ? renameFrom.get(p) : null
    if (renameFrom) rec.channels.rename = Boolean(to)
    if (addedOid && deletedOid) {
      const oid = deletedOid.get(p)
      rec.channels.contentMove = Boolean(oid && [...addedOid.values()].includes(oid))
    }
    if (rec.channels.allowlist) {
      rec.verdict = 'test-allowlisted'
      rec.note = `台账命中${al.entry.ticket ? `(${al.entry.ticket})` : ''}:${al.entry.reason}`
      continue
    }
    if (rec.channels.marker) {
      rec.verdict = 'test-intent-marker'
      rec.note = '提交信息含 intentional-delete: 标记'
      continue
    }
    if (rec.channels.rename) {
      rec.verdict = 'test-renamed'
      rec.note = `git 判为改名 → ${to}`
      continue
    }
    if (rec.channels.contentMove) {
      rec.verdict = 'test-renamed'
      rec.note = '同内容的文件在本笔提交里新增 ⇒ 视为搬家(改了名字但内容未动)'
      continue
    }
    rec.verdict = 'test-red'
  }
  return recs
}

/**
 * E1/E2 的结论与 E3 的结论合并。优先级是**不对称**的,不许对称化:
 *   · E3 判红 ⇒ 红(这正是补丁要补的那一格:E1 对测试件恒绿);
 *   · E1 判红 ⇒ 红(E1 的证据是"索引里还有别的文件引用它",比 E3 强,不被 E3 的记账结论盖掉);
 *   · 其余 ⇒ 取 E3 的记账结论(它比"no-reference"更能说清为什么放过)。
 */
export function mergeE3Results(baseResults, e3Results) {
  if (!e3Results || !e3Results.length) return baseResults
  const byPath = new Map(e3Results.map((r) => [r.path, r]))
  return baseResults.map((r) => {
    const t = byPath.get(r.path)
    if (!t) return r
    if (t.verdict === 'test-red') return { ...t, verdict: 'red', hits: r.hits || [] }
    if (r.verdict === 'red') return r
    return t
  })
}

// ── CLI:git 取材(全程只读,派生本体在 scripts/lib/face-reader.mjs) ──────────────────
function chunk(arr, n) {
  const out = []
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n))
  return out
}
function nul(s) {
  return String(s)
    .split('\0')
    .map((x) => x.replace(/^\//, ''))
    .filter((x) => x.length > 0)
}
/**
 * `git grep --cached` 用 **exit 1** 表达"零命中"(合法的空候选集),其余非零才是真失败。
 * 共用层的 `gitRaw` 把所有非零一律折成 Undetermined 且**不暴露 exit code**,所以这里只能按
 * 可观测的两条特征把"零命中"与"真失败"分开(层的缺失原语:status-aware 的 git 调用):
 *   ① git 没留下任何 stderr 诊断(真失败必有 `fatal:`/`error:` 一类首行);
 *   ② 远未触及超时(超时被 SIGTERM 时同样没有诊断,靠这一条排除)。
 * 两条同时成立才认零命中;否则原样上抛 —— **绝不把"取数失败"静默成"没有引用"**(那等于把红洗成绿)。
 * 常量 ZERO_HIT_MARK 由镜像测试与层的 `gitErrText({stderr:''})` 逐字对账,层若改措辞测试即红。
 */
const ZERO_HIT_MARK = '(git 无输出)'
function grepFiles(root, stems) {
  const args = ['grep', '--cached', '-I', '-z', '-l', '-F']
  for (const s of stems) args.push('-e', s)
  const t0 = Date.now()
  try {
    return nul(gitRaw(args, root, { timeout: GIT_TIMEOUT }))
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg.includes(ZERO_HIT_MARK) && Date.now() - t0 < GIT_TIMEOUT - 10000) return []
    throw new Error(`git grep --cached 失败:${msg}`)
  }
}
/**
 * 候选引用方提供者。默认一次批量 grep 拿**全局**候选集(判据在 JS 侧逐路径精确匹配,
 * 不需要 grep 归属);命中面过大时退化为"按名字分别取候选",避免把不相干的巨型清单灌进判据。
 */
function makeCandidateProvider(root, stems) {
  const uniq = [...new Set(stems)]
  const batches = chunk(uniq, GREP_BATCH)
  const global = new Set()
  for (const b of batches) for (const f of grepFiles(root, b)) global.add(f)
  const list = [...global]
  if (list.length <= GLOBAL_CAND_LIMIT) {
    return {
      getCandidates: () => list,
      mode: `全局候选 ${list.length} 文件 / ${batches.length} 次 grep`,
    }
  }
  const perStem = new Map()
  for (const s of uniq) perStem.set(s, grepFiles(root, [s]))
  return {
    getCandidates: (s) => perStem.get(s) || [],
    mode: `全局候选 ${list.length} 超限 → 按名字分别取候选`,
  }
}
/**
 * 一次 cat-file --batch 读完一批索引 blob(`:path`),避免 N 次派生。
 * 取材本体在层的 `catBatch`(stdio[0]='pipe'、maxBuffer、timeout 都在那一处);这里只把
 * 层的 "Map<rev, text>" 换成本门判据要的 "Map<path, text|null>"(取不到 = null,不抛)。
 */
function readIndexBlobs(root, paths) {
  const map = new Map()
  if (!paths.length) return map
  const got = catBatch(
    root,
    paths.map((p) => `:${p}`),
  )
  for (const p of paths) map.set(p, got.get(`:${p}`) ?? null)
  return map
}
/**
 * E3 的被删内容来源。注意 `:path` 对**暂存删除**按定义就是空的(索引里已经没有这一条)——
 * 那一份内容唯一的存续处是同名的 `HEAD:path`(它正是被删掉的那个 blob)。故这一档**两个面都问**,
 * 任一读到即用、都读不到才算"未判定";绝不退回滞后的共享工作树(§0.4 同面同轮)。
 */
function readDeletedBlobs(root, paths) {
  const map = new Map()
  if (!paths.length) return map
  const specs = [...paths.map((p) => `:${p}`), ...paths.map((p) => `HEAD:${p}`)]
  const got = catBatch(root, specs)
  for (const p of paths) {
    const idx = got.get(`:${p}`)
    const head = got.get(`HEAD:${p}`)
    if (typeof idx === 'string') map.set(p, { text: idx, from: 'index' })
    else if (typeof head === 'string') map.set(p, { text: head, from: 'HEAD' })
    else map.set(p, null)
  }
  return map
}

/**
 * 本次提交的信息面。**pre-commit 阶段结构上还没有消息**(git 先跑 pre-commit、后写
 * `COMMIT_EDITMSG`,实测:pre-commit 里读到的是**上一条**提交的正文),所以默认档必须加一道
 * 陈旧守卫:与 HEAD 正文逐字相同就判"不是本次消息" —— 否则残留的 `intentional-delete:`
 * 会替**之后每一枚**提交免除 E3,那是把一条显式裁决变成永久免检(§0.7 同型)。
 * 想要这条通道真生效,走 `--message` / `--message-file`(commit-msg 阶段复跑时 `$1` 就是它)。
 */
function readPendingMessage(root, argv) {
  const inline = requireFlagValue(argv, '--message', { noun: '提交信息' })
  if (inline.error) return { text: null, from: `--message 取值失败:${inline.error}` }
  if (inline.value !== null) return { text: inline.value, from: '--message' }
  const fileFlag = requireFlagValue(argv, '--message-file', { noun: '文件路径' })
  if (fileFlag.error) return { text: null, from: `--message-file 取值失败:${fileFlag.error}` }
  if (fileFlag.value) {
    const f = resolve(fileFlag.value)
    if (!existsSync(f)) return { text: null, from: `--message-file 指向的文件不存在:${f}` }
    return { text: readFileSync(f, 'utf8'), from: `--message-file ${fileFlag.value}` }
  }
  let editMsg = ''
  try {
    editMsg = gitRaw(['rev-parse', '--git-path', 'COMMIT_EDITMSG'], root, { timeout: 15000 }).trim()
  } catch {
    editMsg = ''
  }
  const editPath = editMsg ? resolve(root, editMsg) : ''
  if (!editPath || !existsSync(editPath))
    return { text: null, from: 'pre-commit 阶段没有消息文件(可用 --message/--message-file 显式给)' }
  let headMsg = ''
  try {
    headMsg = gitRaw(['log', '-1', '--format=%B'], root, { timeout: 15000 })
  } catch {
    headMsg = ''
  }
  const body = readFileSync(editPath, 'utf8')
  if (headMsg && body.trim() === headMsg.trim())
    return { text: null, from: 'COMMIT_EDITMSG 与 HEAD 正文同文 ⇒ 是上一条的残留,不计入通道②' }
  return { text: body, from: 'COMMIT_EDITMSG(与 HEAD 不同文)' }
}

/**
 * E3 的取材总成(一次派生都不多花在射程外:没有测试件删除时调用方根本不进这里)。
 * 取不到的面一律留成 `null` 并写进 `meta.note` —— `null` 与"取到了但是空"是两件事:
 * 前者让通道变成"不可用"(报告里点名),后者才是"通道查过了,没命中"。
 */
function collectE3(root, testDeleted, absentPaths, allow, argv) {
  const meta = { testDeleted: testDeleted.length, messageFrom: '', note: '' }
  const addNote = (s) => {
    meta.note = meta.note ? `${meta.note};${s}` : s
  }
  let renameFrom = null
  try {
    renameFrom = new Map(gitStagedRenamePairs({ root }).map((x) => [x.from, x.to]))
  } catch (e) {
    renameFrom = null
    addNote(`改名面取不到(${e?.message ?? e}),通道①本次不可用`)
  }
  let addedOid = null
  let deletedOid = null
  try {
    const added = nul(gitRaw(['diff', '--cached', '--diff-filter=A', '--name-only', '-z'], root))
    if (added.length <= ADDED_OID_LIMIT) {
      addedOid = catBatchOids(root, added.map((p) => `:${p}`))
      deletedOid = catBatchOids(root, testDeleted.map((p) => `HEAD:${p}`))
    } else {
      addNote(`新增件 ${added.length} 超过 ${ADDED_OID_LIMIT} ⇒ 未做同内容比对`)
    }
  } catch (e) {
    addedOid = null
    deletedOid = null
    addNote(`同内容比对取不到(${e?.message ?? e})`)
  }
  const msg = readPendingMessage(root, argv)
  meta.messageFrom = msg.from
  let blobs = new Map()
  try {
    blobs = readDeletedBlobs(root, testDeleted)
  } catch (e) {
    blobs = null
    addNote(`被删内容取不到(${e?.message ?? e})`)
  }
  const absent = new Set([...(absentPaths || []), ...(renameFrom ? renameFrom.keys() : [])])
  const results = auditTestDeletions(testDeleted, {
    livePaths: nul(gitRaw(['ls-files', '-z'], root)),
    readBlob: (p) => (blobs ? blobs.get(p) ?? null : null),
    renameFrom,
    addedOid,
    deletedOid,
    allow,
    message: msg.text,
    absent,
  })
  return { results, meta }
}

/** 删除面:--staged 只看索引 vs HEAD;--all 追加"工作区相对 HEAD 已消失但未暂存"的那一批 */
function collectDeletions(root, mode) {
  let staged = []
  try {
    staged = nul(gitRaw(['diff', '--cached', '--diff-filter=D', '--name-only', '-z'], root))
  } catch (e) {
    const msg = e instanceof Undetermined ? e.message : String(e?.stderr || e?.message || e)
    if (/unknown revision|bad revision|does not have any commits/i.test(msg))
      return { staged: [], unstaged: [], noHead: true }
    throw new Error(`读取暂存删除失败:${msg}`)
  }
  let unstaged = []
  if (mode === 'all') {
    unstaged = nul(gitRaw(['diff', 'HEAD', '--diff-filter=D', '--name-only', '-z'], root)).filter(
      (p) => !staged.includes(p),
    )
  }
  return { staged, unstaged, noHead: false }
}

async function main() {
  const argv = process.argv.slice(2)
  if (argv.includes('--self-test')) return selfTest()
  // G-322(本站两处):`--root` 与 `--allowlist` 都是"路径型旗标",旧写法把紧邻的下一枚旗标当成路径。
  // 后果分两档 —— `--root --staged` 在一个不存在的根上得出"没有暂存删除";`--allowlist --staged`
  // 则读一个不存在的豁免清单 ⇒ 把**该豁免的行判成违规**(方向相反,但两支都不该由一个少打的值决定)。
  // 现一律走单源出口:给了旗标没拿到值 ⇒ 未判定 exit 2(§22c,判据不在本文件复制)。
  // 本文件 main() 的返回码被顶层 `main().catch()` 丢掉(红档一直靠 process.exit 落),所以这里
  // 必须 process.exit(2) 而不是 return 2 —— 照抄别处的 return 会得到一个"点了名却 rc=0"的门。
  const rootFlag = requireFlagValue(argv, '--root', { noun: '目录' })
  if (rootFlag.error) {
    console.error(`❌ ${rootFlag.error}`)
    process.exit(2)
  }
  const root = rootFlag.value ? resolve(rootFlag.value) : resolve(HERE, '..')
  const mode = argv.includes('--all') ? 'all' : 'staged'
  const asJson = argv.includes('--json')
  const allowFlag = requireFlagValue(argv, '--allowlist', { noun: '文件路径' })
  if (allowFlag.error) {
    console.error(`❌ ${allowFlag.error}`)
    process.exit(2)
  }
  const allowFile = allowFlag.value ? resolve(allowFlag.value) : join(root, ALLOWLIST_REL)
  if (process.env[SELF_SKIP] === '1') {
    console.log(`⏭️  已跳过(${SELF_SKIP}=1):暂存删除存续性对账未执行`)
    return
  }
  const { staged, unstaged, noHead } = collectDeletions(root, mode)
  const allowRaw = existsSync(allowFile) ? readFileSync(allowFile, 'utf8') : null
  const allow = parseAllowlist(allowRaw, ALLOWLIST_REL)
  const deleted = mode === 'all' ? [...staged, ...unstaged] : staged
  const base = {
    mode,
    root,
    staged: staged.length,
    unstaged: unstaged.length,
    noHead,
    allowlistLoaded: allowRaw !== null,
  }
  if (noHead || !deleted.length) {
    const msg = noHead
      ? '仓库尚无提交,无存续性可判定'
      : `无${mode === 'all' ? '待删' : '暂存删除'},判据未触发`
    if (asJson) console.log(JSON.stringify({ ...base, verdict: 'pass', note: msg, results: [] }))
    else {
      console.log(
        `[staged-deletions] ✅ ${msg}(口径=${mode === 'all' ? '暂存删除 + 工作区待删' : '索引 blob'})`,
      )
      if (allow.parseError) console.log(`⚠️ ${allow.parseError}`)
    }
    return
  }
  const livePaths = nul(gitRaw(['ls-files', '-z'], root))
  const liveSet = new Set(livePaths)
  const provider = makeCandidateProvider(
    root,
    deleted.map((p) => stemOf(p)),
  )
  const probe = new Set()
  for (const p of deleted) {
    for (const f of provider.getCandidates(stemOf(p))) if (liveSet.has(f)) probe.add(f)
  }
  const blobs = readIndexBlobs(root, [...probe])
  const results = auditDeletions(deleted, {
    livePaths,
    readFile: (p) => blobs.get(p) ?? null,
    getCandidates: provider.getCandidates,
    allow: allow.entries,
    pendingRemoval: mode === 'all' ? new Set([...staged, ...unstaged]) : new Set(),
  })
  // E3 只对射程内的测试件取材;射程为空时一次 git 派生都不多花(pre-commit 每笔提交都要跑本门)
  const testDeleted = deleted.filter(isTestPath)
  const e3 = testDeleted.length
    ? collectE3(root, testDeleted, deleted, allow.entries, argv)
    : { results: [], meta: { testDeleted: 0, messageFrom: '(射程内无测试件,未取材)', note: '' } }
  const merged = mergeE3Results(results, e3.results)
  const red = merged.filter((r) => r.verdict === 'red')
  const undetermined = merged.filter((r) => r.verdict === 'test-undetermined')
  const counted = merged.filter((r) => r.verdict !== 'red' && r.verdict !== 'clean')
  if (asJson) {
    console.log(
      JSON.stringify({
        ...base,
        grep: provider.mode,
        deleted: deleted.length,
        red: red.length,
        counted: counted.length,
        undetermined: undetermined.length,
        e3: { testDeleted: e3.meta.testDeleted, messageFrom: e3.meta.messageFrom, note: e3.meta.note },
        results: merged,
      }),
    )
    if (red.length) process.exit(1)
    if (undetermined.length) process.exit(2)
    return
  }
  console.log(
    `[staged-deletions] 口径=${mode === 'all' ? '暂存删除 + 工作区待删(全量审计)' : '索引 blob(pre-commit)'} | 待判 ${deleted.length}(暂存 ${staged.length} / 未暂存 ${unstaged.length})| 判红 ${red.length} | 仅一条证据(如实报数) ${counted.length}`,
  )
  console.log(`   取材:${provider.mode};内容口径:索引 blob(不判滞后的共享工作树)`)
  console.log(
    `   E3(测试删除意向):射程内 ${e3.meta.testDeleted} 个测试件 | 提交信息面=${e3.meta.messageFrom}${e3.meta.note ? ` | ${e3.meta.note}` : ''}`,
  )
  if (allow.parseError) console.log(`⚠️ ${allow.parseError}`)
  if (!red.length && undetermined.length) {
    console.log(`❌ E3 未判定 ${undetermined.length} 个测试件删除(取不到被删内容 ⇒ 既不算绿也不算红):`)
    for (const r of undetermined) console.log(`   ${r.path} — ${r.note}`)
    console.log('   下一步:确认这些路径确实在索引面(暂存删除)⇒ 用 `git show HEAD:<path>` 能取到内容;')
    console.log('     取不到说明它连 HEAD 面也没有(从未入库?),请人工核对清单后重跑。')
    process.exit(2)
  }
  if (!red.length) {
    console.log('✅ 无"仍被仓库引用且索引里无替代路径"的删除')
    for (const r of counted)
      console.log(`   · [${r.verdict}] ${r.path}${r.note ? ` — ${r.note}` : ''}`)
    return
  }
  console.log(`❌ ${red.length} 个文件被暂存删除,但仓库仍在引用它(且索引里没有替代路径):`)
  for (const r of red) {
    console.log(`   ${r.path}`)
    if (r.kind === 'E3') {
      for (const m of r.modules.slice(0, 6))
        console.log(`      它测的模块仍在 ${m.path} [${m.form}] ${m.spec}:${m.line}`)
      if (r.modules.length > 6) console.log(`      …另有 ${r.modules.length - 6} 个被测模块`)
      const ch = r.channels || {}
      const mark = (v) => (v === true ? '成立' : v === false ? '未成立' : '不可用')
      console.log(
        `      放过通道:①重命名=${mark(ch.rename)} ②intentional-delete=${mark(ch.marker)} ③台账=${mark(ch.allowlist)}${ch.allowlistNote ? `(${ch.allowlistNote})` : ''} | 提交信息面=${e3.meta.messageFrom}`,
      )
      console.log(
        '      下一步(三选一):① 宿主误删 ⇒ `git checkout HEAD -- ' +
          r.path +
          '`;② 确属有意 ⇒ 提交信息写 `intentional-delete: <原因>`(pre-commit 阶段还不存在消息,须用 `--message` / commit-msg 阶段复跑);③ 登记 ' +
          ALLOWLIST_REL +
          '(path+reason+until)',
      )
      continue
    }
    for (const h of r.hits.slice(0, 6))
      console.log(`      引用方 ${h.file}:${h.line} [${h.form}] ${h.spec}`)
    if (r.hits.length > 6) console.log(`      …另有 ${r.hits.length - 6} 处引用`)
  }
  for (const r of counted)
    console.log(`   (不计红,仅报数)[${r.verdict}] ${r.path}${r.note ? ` — ${r.note}` : ''}`)
  if (undetermined.length) {
    console.log(`   (未判定,不冒绿也不冒红)E3 取不到被删内容 ${undetermined.length} 条:`)
    for (const r of undetermined) console.log(`      ${r.path} — ${r.note}`)
  }
  console.log('   先分清成因,再决定动作(本门只读,不会替你恢复任何东西):')
  console.log(
    '     ① 宿主清理层成批删的? 逐路径找回内容即可:`git checkout HEAD -- <path>`(**禁止**全局 reset --hard)',
  )
  console.log(
    '     ② 确属有意删除? 把引用方一并改掉(barrel / import),或登记进 ' +
      ALLOWLIST_REL +
      '(必须写 reason)',
  )
  console.log('     ③ 单独复验:node scripts/check-staged-deletions.mjs')
  console.log(
    `   紧急跳过:${SELF_SKIP}=1 git commit ...(等价把已入库的功能与测试从版本树里删掉,慎用)`,
  )
  process.exit(1)
}

// ── 自检:正反成对(纯内存夹具,绝不碰真仓索引) ─────────────────────────────────────
function selfTest() {
  const run = (files, deletedList, allow = []) => {
    const live = Object.keys(files).filter((p) => !deletedList.includes(p))
    return auditDeletions(deletedList, {
      livePaths: live,
      readFile: (p) => (p in files ? files[p] : null),
      getCandidates: (stem) => live.filter((f) => String(files[f]).includes(stem)),
      allow,
    })[0]
  }
  const cases = [
    {
      name: '① barrel 仍 export 被删模块 ⇒ 必判红(真实事故形态)',
      files: {
        'p/chat/index.ts': "export * from './input-notices'\n",
        'p/chat/input-notices.ts': 'export const a = 1',
      },
      del: ['p/chat/input-notices.ts'],
      want: 'red',
    },
    {
      name: '② 引用方(barrel)自己也一起删 ⇒ 放过(与①成对)',
      files: {
        'p/chat/index.ts': "export * from './input-notices'\n",
        'p/chat/input-notices.ts': 'export const a = 1',
      },
      del: ['p/chat/input-notices.ts', 'p/chat/index.ts'],
      want: 'no-reference',
    },
    {
      name: '③ 相对 import 指向被删文件 ⇒ 红',
      files: {
        'a/i.ts': "import { f } from '../lib/gone-helper'\n",
        'lib/gone-helper.ts': 'export const f = 1',
      },
      del: ['lib/gone-helper.ts'],
      want: 'red',
    },
    {
      name: '④ require() 形式同样算引用 ⇒ 红',
      files: {
        'a/i.cjs': "const x = require('../lib/gone-cjs')\n",
        'lib/gone-cjs.js': 'module.exports = {}',
      },
      del: ['lib/gone-cjs.js'],
      want: 'red',
    },
    {
      name: '⑤ 整路径字面量(别的守门清单)⇒ 红',
      files: {
        'a/i.mjs': "export const HOT = ['lib/gone-list.mjs']\n",
        'lib/gone-list.mjs': 'export const x = 1',
      },
      del: ['lib/gone-list.mjs'],
      want: 'red',
    },
    {
      name: '⑥ 别名路径 @/ + 父目录名对上 ⇒ 红',
      files: {
        'w/x/i.ts': "import { N } from '@/components/chat/gone-banner'\n",
        'components/chat/gone-banner.tsx': 'export const N = 1',
      },
      del: ['components/chat/gone-banner.tsx'],
      want: 'red',
    },
    {
      name: '⑦ 同名文件已在别的目录存续(= 已迁移)⇒ 不判红',
      files: {
        'a/i.ts': "import { f } from './gone-moved'\n",
        'b/gone-moved.ts': 'export const f = 1',
        'a/gone-moved.ts': 'export const f = 1',
      },
      del: ['a/gone-moved.ts'],
      want: 'alternative-path',
    },
    {
      name: '⑧ 唯一引用方落在夹具/产物目录 ⇒ 不判红',
      files: {
        'src/gone-fixture.ts': 'export const f = 1',
        'dist/bundle.js': "require('../src/gone-fixture')",
        'testdata/gone-fixture.helper.ts': "from '../src/gone-fixture'",
      },
      del: ['src/gone-fixture.ts'],
      want: 'no-reference',
    },
    {
      name: '⑨ 唯一引用方在 baseline 记账 JSON ⇒ 不判红',
      files: {
        'x/gone-tool.mjs': 'export const a = 1',
        'scripts/gone-baseline.json': '{"x/gone-tool.mjs":3}',
      },
      del: ['x/gone-tool.mjs'],
      want: 'no-reference',
    },
    {
      name: '⑩ 只有 .md 提到 ⇒ 文档叙述不算依赖',
      files: {
        'docs/gone-doc.md': 'see src/util/gone-utils.ts and gone-utils',
        'src/util/gone-utils.ts': 'export const a = 1',
      },
      del: ['src/util/gone-utils.ts'],
      want: 'no-reference',
    },
    {
      name: '⑪ 注释里的示例 import ⇒ 不判(防假红第一道)',
      files: {
        'a/i.ts': "// import { f } from './gone-commented'\nexport const k = 1\n",
        'a/gone-commented.ts': 'export const f = 1',
      },
      del: ['a/gone-commented.ts'],
      want: 'no-reference',
    },
    {
      name: '⑫ 相对说明符另有同名现存目标(歧义)⇒ 放过',
      files: {
        'a/i.ts': "import { f } from './gone-ambig'\n",
        'a/gone-ambig/index.ts': 'export const f = 1',
        'a/gone-ambig.ts': 'export const f = 1',
      },
      del: ['a/gone-ambig.ts'],
      want: 'no-reference',
    },
    {
      name: '⑬ 外部包同名(react/jsx-runtime 型)⇒ 父目录对不上,不判',
      files: {
        'a/i.ts': "import { r } from 'react/jsx-runtime'\n",
        'src/theme/jsx-runtime.ts': 'export const r = 1',
      },
      del: ['src/theme/jsx-runtime.ts'],
      want: 'no-reference',
    },
    {
      name: '⑭ 名字过短 ⇒ 判据不可用,如实报 undetermined(不静默)',
      files: { 'a/i.ts': "import { f } from './qq'\n", 'a/qq.ts': 'export const f = 1' },
      del: ['a/qq.ts'],
      want: 'undetermined',
    },
    {
      name: '⑮ 候选面过大 ⇒ undetermined 而非判红',
      files: {
        'a/i.ts': "import { f } from './gone-wide'\n",
        'a/gone-wide.ts': 'export const f = 1',
      },
      del: ['a/gone-wide.ts'],
      want: 'undetermined',
      wide: true,
    },
    {
      name: '⑯ 豁免清单精确命中 ⇒ 只报数',
      files: {
        'a/i.ts': "import { f } from './gone-exempt'\n",
        'a/gone-exempt.ts': 'export const f = 1',
      },
      del: ['a/gone-exempt.ts'],
      want: 'allowlisted',
      allow: [{ pattern: 'a/gone-exempt.ts', reason: '测试豁免' }],
    },
    {
      name: '⑰ 豁免清单目录前缀 a/** ⇒ 只报数',
      files: {
        'a/i.ts': "import { f } from './gone-exempt2'\n",
        'a/gone-exempt2.ts': 'export const f = 1',
      },
      del: ['a/gone-exempt2.ts'],
      want: 'allowlisted',
      allow: [{ pattern: 'a/**', reason: '整目录有意删除' }],
    },
    {
      name: '⑱ 无任何引用 ⇒ no-reference',
      files: { 'z/gone-solo.ts': 'export const a = 1', 'q/other.ts': 'export const b = 1' },
      del: ['z/gone-solo.ts'],
      want: 'no-reference',
    },
    {
      name: '⑲ JSON 配置(tsconfig include)引用也算依赖 ⇒ 红',
      files: {
        'tsconfig.x.json': '{"include":["./src/gone-mod.ts"]}',
        'src/gone-mod.ts': 'export const a = 1',
      },
      del: ['src/gone-mod.ts'],
      want: 'red',
    },
    {
      name: '⑳ 生成物里的引用不算存续性证据',
      files: {
        'src/a/i.gen.ts': "export * from './gone-gen'",
        'src/a/gone-gen.ts': 'export const a = 1',
      },
      del: ['src/a/gone-gen.ts'],
      want: 'no-reference',
    },
    {
      name: '㉑ 动态 import() 形式也算引用 ⇒ 红',
      files: {
        'a/i.ts': "const m = await import('./gone-dyn')\n",
        'a/gone-dyn.ts': 'export const f = 1',
      },
      del: ['a/gone-dyn.ts'],
      want: 'red',
    },
    {
      name: '㉒ TS 的 ./x.js 写法指向被删的 x.ts ⇒ 红',
      files: {
        'a/i.ts': "import { f } from './gone-jsform.js'\n",
        'a/gone-jsform.ts': 'export const f = 1',
      },
      del: ['a/gone-jsform.ts'],
      want: 'red',
    },
    {
      name: '㉓ 测试夹具目录(__tests__ 是真测试,不是夹具)⇒ 仍算引用方 ⇒ 红',
      files: {
        'a/__tests__/gone-real.test.ts': "import { f } from '../gone-real'\n",
        'a/gone-real.ts': 'export const f = 1',
      },
      del: ['a/gone-real.ts'],
      want: 'red',
    },
    {
      // ㉔/㉕ 成对:别名与整仓库路径字面量这两个形态也必须认"同 stem 另一份实现还在"这条歧义 ——
      // 守门 98 的 D4 影子维规定"删掉那份 .js、别去改说明符",缺这一层时门 99 会把门 98 的正确修法拦死。
      name: '㉔ 删影子 X.js 而同目录 X.ts 存活 ⇒ 别名/字面量引用未断 ⇒ 放过(D4 修法不被拦)',
      files: {
        'pkg/svc/concurrency.js': 'export const v = 1\n',
        'pkg/svc/concurrency.ts': 'export const v = 1\n',
        'pkg/tests/concurrency.test.ts': "import { v } from 'pkg/svc/concurrency.ts'\n",
        'scripts/tests/shape.test.mjs': "const lit = 'pkg/svc/concurrency.js'\n",
      },
      del: ['pkg/svc/concurrency.js'],
      want: 'no-reference',
    },
    {
      name: '㉕ 与㉔成对:同 stem 没有另一份存活时,别名/字面量引用照旧判红(放过不等于取消)',
      files: {
        'pkg/svc/concurrency.js': 'export const v = 1\n',
        'pkg/tests/concurrency.test.ts': "import { v } from 'pkg/svc/concurrency.js'\n",
      },
      del: ['pkg/svc/concurrency.js'],
      want: 'red',
    },
  ]
  // ── E3 夹具(正反成对) ────────────────────────────────────────────────────────
  // 第一例就是 2026-10-27 那枚事故的形态:测试文件从不被生产文件 import ⇒ E1 恒绿。
  const ACC = "import { track } from '../src/components/AnalyticsCapture'\n\ndescribe('x', () => {})\n"
  const ACC_MOD = 'export const track = (n: string) => n\n'
  const accFiles = {
    'apps/web/tests/analytics-capture-aria-label.test.tsx': ACC,
    'apps/web/src/components/AnalyticsCapture.tsx': ACC_MOD,
  }
  const accTest = 'apps/web/tests/analytics-capture-aria-label.test.tsx'
  let fail = 0
  for (const c of cases) {
    let r
    if (c.wide) {
      const live = Object.keys(c.files).filter((p) => !c.del.includes(p))
      r = auditDeletions(c.del, {
        livePaths: live,
        readFile: (p) => (p in c.files ? c.files[p] : null),
        getCandidates: () =>
          Array.from({ length: MAX_CANDIDATES + 1 }, (_, i) => `bulk/gone-wide${i}.ts`),
        allow: [],
      })[0]
    } else r = run(c.files, c.del, c.allow)
    const ok = r && r.verdict === c.want
    if (!ok) fail++
    console.log(`${ok ? '✅' : '❌'} ${c.name} → ${r ? r.verdict : 'n/a'}(期望 ${c.want})`)
  }
  // ── E3:正例 + 三条放过通道 + 变异自证 ─────────────────────────────────────────
  const runE3 = (files, del, extra = {}) => {
    const live = Object.keys(files).filter((p) => !del.includes(p))
    return auditTestDeletions(del, {
      livePaths: live,
      readBlob: (p) => (p in files ? { text: files[p], from: 'fixture' } : null),
      allow: [],
      ...extra,
    })[0]
  }
  const e3cases = [
    {
      name: 'E3① 删测试而它测的模块仍在索引面 ⇒ 判红(事故形态,E1 在这里恒绿)',
      got: runE3(accFiles, [accTest]),
      want: 'test-red',
      check: (r) => r.modules[0]?.path === 'apps/web/src/components/AnalyticsCapture.tsx',
    },
    {
      name: 'E3② 放过通道①:同一路径是改名形态 ⇒ 放过',
      got: runE3(accFiles, [accTest], { renameFrom: new Map([[accTest, 'apps/web/tests/x-v2.test.tsx']]) }),
      want: 'test-renamed',
    },
    {
      name: 'E3③ 放过通道②:提交信息带 intentional-delete: ⇒ 放过',
      got: runE3(accFiles, [accTest], { message: 'refactor: 删测试\n\nintentional-delete: 该测试测的组件已迁到 e2e' }),
      want: 'test-intent-marker',
    },
    {
      name: 'E3④ 放过通道③:豁免台账命中(未过期)⇒ 放过',
      got: runE3(accFiles, [accTest], {
        allow: [{ pattern: accTest, reason: '测试与组件同批删除', ticket: 'G-1', until: null, untilRaw: null }],
      }),
      want: 'test-allowlisted',
    },
    {
      name: 'E3⑤ 台账 until 已过期 ⇒ 逾期即失效,照旧判红(与④成对)',
      got: runE3(accFiles, [accTest], {
        allow: [{ pattern: accTest, reason: 'x', ticket: null, until: '2020-01-01', untilRaw: '2020-01-01' }],
        today: '2026-10-27',
      }),
      want: 'test-red',
    },
    {
      name: 'E3⑥ 放过通道③的另一面:同内容文件在本笔新增(改名检测没配对)⇒ 放过',
      got: runE3(accFiles, [accTest], {
        addedOid: new Map([['apps/web/tests/x-v2.test.tsx', 'oid-A']]),
        deletedOid: new Map([[accTest, 'oid-A']]),
      }),
      want: 'test-renamed',
    },
    {
      name: 'E3⑦ 本笔提交把被测模块也一起删了 ⇒ 放过(题二:源模块自己也没了)',
      got: runE3(accFiles, [accTest, 'apps/web/src/components/AnalyticsCapture.tsx'], {
        absent: new Set(['apps/web/src/components/AnalyticsCapture.tsx']),
      }),
      want: 'no-repo-consumer',
    },
    {
      name: 'E3⑧ 只引用兄弟测试/夹具 ⇒ 不算"被测模块"(否则每次合并测试都判红)',
      got: runE3({ 'a/tests/x.test.ts': "import { h } from './helpers'\n", 'a/tests/helpers.ts': 'export const h = 1' }, [
        'a/tests/x.test.ts',
      ]),
      want: 'no-repo-consumer',
    },
    {
      name: 'E3⑨ 别名 @/ 唯一命中 ⇒ 同样判红(解析不出来就跳过,这里要求真解析)',
      got: runE3(
        {
          'apps/web/tests/analytics.test.ts': "import { track } from '@/lib/analytics'\n",
          'apps/web/src/lib/analytics.ts': 'export const track = 1\n',
        },
        ['apps/web/tests/analytics.test.ts'],
      ),
      want: 'test-red',
    },
    {
      name: 'E3⑩ 被删内容取不到(:p 与 HEAD:p 都没)⇒ 未判定(不冒绿也不冒红)',
      got: runE3(accFiles, [accTest], { readBlob: () => null }),
      want: 'test-undetermined',
    },
    {
      // 变异自证:同一夹具只跑 E1/E2(等于把 E3 那几行摘掉)⇒ 翻绿。这就是事故的复现路径,
      // 因此"本门现在能拦住它"这件事只能在 E1/E2 判绿的前提下由 E3 单独证明。
      // 候选面刻意给成"全部存续文件"(而不是按名字过滤),证明 E1 真的看过那个模块仍绿,
      // 而不是因为候选集为空才绿 —— 后者是假绿,不构成缺口复现。
      name: 'E3⑪ 摘掉 E3(只跑原 E1/E2)⇒ 同一夹具翻绿 —— 缺口复现即变异自证',
      got: {
        verdict: auditDeletions([accTest], {
          livePaths: Object.keys(accFiles).filter((p) => p !== accTest),
          readFile: (p) => (p in accFiles ? accFiles[p] : null),
          getCandidates: () => Object.keys(accFiles).filter((p) => p !== accTest),
          allow: [],
        })[0].verdict,
      },
      want: 'no-reference',
    },
  ]
  for (const c of e3cases) {
    const ok = c.got && c.got.verdict === c.want && (!c.check || c.check(c.got))
    if (!ok) fail++
    console.log(`${ok ? '✅' : '❌'} ${c.name} → ${c.got ? c.got.verdict : 'n/a'}(期望 ${c.want})`)
  }
  const unit = [
    ['stemOf 只剥最后一个扩展名', stemOf('a/b/c.input-notices.ts') === 'c.input-notices'],
    ['joinRel 处理 ..', joinRel('a/b', '../c/d.ts') === 'a/c/d.ts'],
    ['joinRel 逃出仓库根返回 null', joinRel('a', '../../x') === null],
    ['moduleCandidates 认 TS 的 .js 写法', moduleCandidates('a/x.js').includes('a/x.ts')],
    [
      'classifySpecifier 拒收 URL',
      classifySpecifier('https://x/gone-a.ts', 'a.ts', 'gone-a.ts', new Set()) === null,
    ],
    [
      'classifySpecifier 拒收裸包名',
      classifySpecifier('gone-a', 'a.ts', 'x/gone-a.ts', new Set()) === null,
    ],
    [
      'matchAllowlist 认目录前缀',
      !!matchAllowlist('p/q/r.ts', [{ pattern: 'p/q/**', reason: '' }]),
    ],
    [
      'parseAllowlist 缺文件不报错也不放行',
      parseAllowlist(null, 'x').entries.length === 0 && !parseAllowlist(null, 'x').parseError,
    ],
    ['parseAllowlist 坏 JSON 必须显式报错', !!parseAllowlist('{oops', 'x').parseError],
    [
      'codeLines 剥整行 // 与 * 注释',
      !/ghost-module/.test(codeLines("// from './ghost-module'\n * x\nexport const a = 1", 'a.ts')),
    ],
    // ── E3 单元:射程 / 说明符抽取 / 合并优先级 / 台账到期 ──
    [
      'isTestPath 认 tests?/__tests__/ 目录与 *.test.* 与 *.spec.*',
      ['a/tests/x.ts', 'a/test/x.ts', 'a/__tests__/x.ts', 'a/x.test.tsx', 'a/x.spec.ts', 'x.test.mjs'].every(isTestPath),
    ],
    [
      'isTestPath 不把生产件/夹具当测试件',
      !['scripts/check-mass-deletion.mjs', 'apps/web/src/app.tsx', 'a/testdata/x.ts'].some(isTestPath),
    ],
    [
      'extractModuleSpecifiers 认 from/require/import() 并剥注释',
      (() => {
        const got = extractModuleSpecifiers(
          "// import x from './ghost'\nimport a from './a'\nconst b = require('./b')\nconst c = await import('./c')\nexpect(f).toBe('./not-a-dep')\n",
          'a/tests/x.test.ts',
        ).map((x) => x.spec)
        return JSON.stringify(got) === JSON.stringify(['./a', './b', './c'])
      })(),
    ],
    [
      'mergeE3Results:E3 红抬进结果,E1 红不被 E3 的记账结论降级',
      (() => {
        const base = [
          { path: 'a.test.ts', verdict: 'no-reference', hits: [] },
          { path: 'b.test.ts', verdict: 'red', hits: [{ file: 'x.ts' }] },
        ]
        const e3 = [
          { path: 'a.test.ts', kind: 'E3', verdict: 'test-red', modules: [] },
          { path: 'b.test.ts', kind: 'E3', verdict: 'test-allowlisted', modules: [] },
        ]
        const m = mergeE3Results(base, e3)
        return m[0].verdict === 'red' && m[1].verdict === 'red'
      })(),
    ],
    [
      'matchAllowlistLive:until 过期与写坏都不认(豁免会到期,证明不了在有效期内就不免)',
      !matchAllowlistLive('a.test.ts', [{ pattern: 'a.test.ts', reason: 'r', until: '2020-01-01', untilRaw: '2020-01-01' }], '2026-10-27')
        .entry && !matchAllowlistLive('a.test.ts', [{ pattern: 'a.test.ts', reason: 'r', until: null, untilRaw: 'nope' }], '2026-10-27').entry,
    ],
  ]
  for (const [name, ok] of unit) {
    if (!ok) fail++
    console.log(`${ok ? '✅' : '❌'} ${name}`)
  }
  console.log(
    fail
      ? `❌ 自检失败 ${fail} 项`
      : `✅ 全部 ${cases.length + e3cases.length + unit.length} 项通过(正反成对;含 E3 正例 + 三条放过通道 + 变异自证)`,
  )
  process.exit(fail ? 1 : 0)
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main().catch((e) => {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  })
}

export const __test__ = {
  stemOf,
  dirOf,
  joinRel,
  moduleCandidates,
  altSiblingsAlive,
  codeLines,
  extractStrings,
  classifySpecifier,
  referencesFor,
  matchAllowlist,
  parseAllowlist,
  auditDeletions,
  auditTestDeletions,
  mergeE3Results,
  isTestPath,
  extractModuleSpecifiers,
  buildStemIndex,
  resolveAliasSpec,
  matchAllowlistLive,
  grepFiles,
  readIndexBlobs,
  collectDeletions,
  /** 层把"git 没留诊断"折成这个串;镜像测试拿它与层的 `gitErrText({stderr:''})` 逐字对账 */
  ZERO_HIT_MARK,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
