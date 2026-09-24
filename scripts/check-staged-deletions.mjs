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
 * 豁免清单:`scripts/staged-deletions-allowlist.json`(不存在时正常工作,不作为判据失效)
 *   { "paths": [ "a/b.ts", { "path": "c/d.ts", "reason": "已迁到 e/f.ts" } ] }
 * 应急跳过:HUSKY_SKIP_STAGED_DELETIONS=1 git commit ...
 * 退出码:0 通过 / 1 违规 / 2 脚本自身异常(异常绝不静默放行)
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { resolveGitBin } from './lib/gitdir.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const SELF_SKIP = 'HUSKY_SKIP_STAGED_DELETIONS'
const ALLOWLIST_REL = 'scripts/staged-deletions-allowlist.json'
const GIT = resolveGitBin() || 'git'
const GIT_TIMEOUT = 60000
const BATCH_TIMEOUT = 180000
const GREP_BATCH = 60
/** 全局候选文件数超过该上限 → 改按单个名字分别取候选(精确度优先于一次派生) */
const GLOBAL_CAND_LIMIT = 1500
/** 短于此长度的名字(如 `a.ts`)全仓子串命中量巨大且必然撞名 → 不判,如实报数 */
const MIN_STEM = 4
/** 单个名字的候选数超上限 → 判据过宽,不判红(宁漏) */
const MAX_CANDIDATES = 2000
/** 删除面超上限 → 那是守门 65(整树删除拦截)的地盘,本门只报数不判红,免得 pre-commit 卡死 */
const MAX_DELETED_JUDGED = 400
/** 人类可读输出里最多点名多少条(其余只报数,避免刷屏) */
const PRINT_CAP = 40

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
const HASH_RE = /^([0-9a-f]{40}) blob (\d+)$/
const KNOWN_EXT = /\.(ts|tsx|js|jsx|mjs|cjs|json|css|scss|less|html|vue|svelte|svg|png|jpe?g|gif|webp|md)$/i

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
    for (const m of body.matchAll(/(['"`])((?:\\.|(?!\1)[^\n\\]){0,300})\1/g)) out.push({ no, s: m[2] })
  }
  return out
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
    return { entries: [], parseError: `${sourceName} JSON 解析失败(${e?.message || e}),本次按空清单执行(不因此放行任何一条)`, missing: false }
  }
  const list = Array.isArray(obj) ? obj : Array.isArray(obj?.paths) ? obj.paths : []
  const entries = []
  for (const it of list) {
    if (typeof it === 'string' && it.trim()) entries.push({ pattern: normEntry(it), reason: '' })
    else if (it && typeof it.path === 'string' && it.path.trim())
      entries.push({ pattern: normEntry(it.path), reason: String(it.reason || '(清单未写 reason)') })
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
export function auditDeletions(deleted, { livePaths, readFile, getCandidates, allow = [], pendingRemoval = new Set() }) {
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
    const candidates = raw.filter((f) => REF_EXT.test(f) && !REF_EXCLUDE.test(f) && !ACCOUNTING.test(f) && !GENERATED.test(f) && liveSet.has(f))
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
      rec.note = rec.ignoredReferrers ? `另有 ${rec.ignoredReferrers} 处命中落在夹具/产物/记账文件,不计` : ''
      continue
    }
    rec.verdict = 'red'
    rec.hits = hits
  }
  return prelim.map((x) => x.rec)
}

// ── CLI:git 取材(全程只读) ───────────────────────────────────────────────────────
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
function gitOut(root, args, timeout = GIT_TIMEOUT) {
  return execFileSync(GIT, ['-c', 'safe.directory=*', '-c', 'core.quotepath=false', '-C', root, ...args], {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 512 << 20,
    timeout,
  })
}
/** `git grep --cached -l -F`:exit 1 = 无命中(正常);其它非零 = 异常上抛(绝不静默当"没有引用") */
function grepFiles(root, stems) {
  const args = ['grep', '--cached', '-I', '-z', '-l', '-F']
  for (const s of stems) args.push('-e', s)
  try {
    return nul(gitOut(root, args))
  } catch (e) {
    if (e && e.status === 1) return []
    throw new Error(`git grep --cached 失败:${e?.stderr || e?.message || e}`)
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
    return { getCandidates: () => list, mode: `全局候选 ${list.length} 文件 / ${batches.length} 次 grep` }
  }
  const perStem = new Map()
  for (const s of uniq) perStem.set(s, grepFiles(root, [s]))
  return { getCandidates: (s) => perStem.get(s) || [], mode: `全局候选 ${list.length} 超限 → 按名字分别取候选` }
}
/** 一次 cat-file --batch 读完一批索引 blob(`:path`),避免 N 次派生 */
function readIndexBlobs(root, paths) {
  const map = new Map()
  if (!paths.length) return map
  const input = paths.map((p) => `:${p}`).join('\n') + '\n'
  let out
  try {
    out = execFileSync(GIT, ['-c', 'safe.directory=*', '-C', root, 'cat-file', '--batch'], {
      cwd: root,
      windowsHide: true,
      maxBuffer: 512 << 20,
      timeout: BATCH_TIMEOUT,
      input: Buffer.from(input, 'utf8'),
    })
  } catch (e) {
    throw new Error(`git cat-file --batch 失败:${e?.stderr?.toString?.() || e?.message || e}`)
  }
  let pos = 0
  for (const p of paths) {
    const nl = out.indexOf(0x0a, pos)
    if (nl < 0) {
      map.set(p, null)
      continue
    }
    const header = out.subarray(pos, nl).toString('utf8')
    pos = nl + 1
    const m = HASH_RE.exec(header)
    if (!m) {
      map.set(p, null) // ":<path> missing" —— 不在索引里
      continue
    }
    map.set(p, out.subarray(pos, pos + Number(m[2])).toString('utf8'))
    pos += Number(m[2]) + 1
  }
  return map
}
/** 删除面:--staged 只看索引 vs HEAD;--all 追加"工作区相对 HEAD 已消失但未暂存"的那一批 */
function collectDeletions(root, mode) {
  let staged = []
  try {
    staged = nul(gitOut(root, ['diff', '--cached', '--diff-filter=D', '--name-only', '-z']))
  } catch (e) {
    const msg = String(e?.stderr || e?.message || e)
    if (/unknown revision|bad revision|does not have any commits/i.test(msg)) return { staged: [], unstaged: [], noHead: true }
    throw new Error(`读取暂存删除失败:${msg}`)
  }
  let unstaged = []
  if (mode === 'all') {
    unstaged = nul(gitOut(root, ['diff', 'HEAD', '--diff-filter=D', '--name-only', '-z'])).filter((p) => !staged.includes(p))
  }
  return { staged, unstaged, noHead: false }
}

async function main() {
  const argv = process.argv.slice(2)
  if (argv.includes('--self-test')) return selfTest()
  const rootIdx = argv.indexOf('--root')
  const root = rootIdx >= 0 ? resolve(argv[rootIdx + 1]) : resolve(HERE, '..')
  const mode = argv.includes('--all') ? 'all' : 'staged'
  const asJson = argv.includes('--json')
  const allowIdx = argv.indexOf('--allowlist')
  const allowFile = allowIdx >= 0 ? resolve(argv[allowIdx + 1]) : join(root, ALLOWLIST_REL)
  if (process.env[SELF_SKIP] === '1') {
    console.log(`⏭️  已跳过(${SELF_SKIP}=1):暂存删除存续性对账未执行`)
    return
  }
  const { staged, unstaged, noHead } = collectDeletions(root, mode)
  const allowRaw = existsSync(allowFile) ? readFileSync(allowFile, 'utf8') : null
  const allow = parseAllowlist(allowRaw, ALLOWLIST_REL)
  const deleted = mode === 'all' ? [...staged, ...unstaged] : staged
  const base = { mode, root, staged: staged.length, unstaged: unstaged.length, noHead, allowlistLoaded: allowRaw !== null }
  if (noHead || !deleted.length) {
    const msg = noHead ? '仓库尚无提交,无存续性可判定' : `无${mode === 'all' ? '待删' : '暂存删除'},判据未触发`
    if (asJson) console.log(JSON.stringify({ ...base, verdict: 'pass', note: msg, results: [] }))
    else {
      console.log(`[staged-deletions] ✅ ${msg}(口径=${mode === 'all' ? '暂存删除 + 工作区待删' : '索引 blob'})`)
      if (allow.parseError) console.log(`⚠️ ${allow.parseError}`)
    }
    return
  }
  const livePaths = nul(gitOut(root, ['ls-files', '-z']))
  const liveSet = new Set(livePaths)
  const provider = makeCandidateProvider(root, deleted.map((p) => stemOf(p)))
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
  const red = results.filter((r) => r.verdict === 'red')
  const counted = results.filter((r) => r.verdict !== 'red' && r.verdict !== 'clean')
  if (asJson) {
    console.log(JSON.stringify({ ...base, grep: provider.mode, deleted: deleted.length, red: red.length, counted: counted.length, results }))
    if (red.length) process.exit(1)
    return
  }
  console.log(
    `[staged-deletions] 口径=${mode === 'all' ? '暂存删除 + 工作区待删(全量审计)' : '索引 blob(pre-commit)'} | 待判 ${deleted.length}(暂存 ${staged.length} / 未暂存 ${unstaged.length})| 判红 ${red.length} | 仅一条证据(如实报数) ${counted.length}`,
  )
  console.log(`   取材:${provider.mode};内容口径:索引 blob(不判滞后的共享工作树)`)
  if (allow.parseError) console.log(`⚠️ ${allow.parseError}`)
  if (!red.length) {
    console.log('✅ 无"仍被仓库引用且索引里无替代路径"的删除')
    for (const r of counted) console.log(`   · [${r.verdict}] ${r.path}${r.note ? ` — ${r.note}` : ''}`)
    return
  }
  console.log(`❌ ${red.length} 个文件被暂存删除,但仓库仍在引用它(且索引里没有替代路径):`)
  for (const r of red) {
    console.log(`   ${r.path}`)
    for (const h of r.hits.slice(0, 6)) console.log(`      引用方 ${h.file}:${h.line} [${h.form}] ${h.spec}`)
    if (r.hits.length > 6) console.log(`      …另有 ${r.hits.length - 6} 处引用`)
  }
  for (const r of counted) console.log(`   (不计红,仅报数)[${r.verdict}] ${r.path}${r.note ? ` — ${r.note}` : ''}`)
  console.log('   先分清成因,再决定动作(本门只读,不会替你恢复任何东西):')
  console.log('     ① 宿主清理层成批删的? 逐路径找回内容即可:`git checkout HEAD -- <path>`(**禁止**全局 reset --hard)')
  console.log('     ② 确属有意删除? 把引用方一并改掉(barrel / import),或登记进 ' + ALLOWLIST_REL + '(必须写 reason)')
  console.log('     ③ 单独复验:node scripts/check-staged-deletions.mjs')
  console.log(`   紧急跳过:${SELF_SKIP}=1 git commit ...(等价把已入库的功能与测试从版本树里删掉,慎用)`)
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
    { name: '① barrel 仍 export 被删模块 ⇒ 必判红(真实事故形态)', files: { 'p/chat/index.ts': "export * from './input-notices'\n", 'p/chat/input-notices.ts': 'export const a = 1' }, del: ['p/chat/input-notices.ts'], want: 'red' },
    { name: '② 引用方(barrel)自己也一起删 ⇒ 放过(与①成对)', files: { 'p/chat/index.ts': "export * from './input-notices'\n", 'p/chat/input-notices.ts': 'export const a = 1' }, del: ['p/chat/input-notices.ts', 'p/chat/index.ts'], want: 'no-reference' },
    { name: '③ 相对 import 指向被删文件 ⇒ 红', files: { 'a/i.ts': "import { f } from '../lib/gone-helper'\n", 'lib/gone-helper.ts': 'export const f = 1' }, del: ['lib/gone-helper.ts'], want: 'red' },
    { name: '④ require() 形式同样算引用 ⇒ 红', files: { 'a/i.cjs': "const x = require('../lib/gone-cjs')\n", 'lib/gone-cjs.js': 'module.exports = {}' }, del: ['lib/gone-cjs.js'], want: 'red' },
    { name: '⑤ 整路径字面量(别的守门清单)⇒ 红', files: { 'a/i.mjs': "export const HOT = ['lib/gone-list.mjs']\n", 'lib/gone-list.mjs': 'export const x = 1' }, del: ['lib/gone-list.mjs'], want: 'red' },
    { name: '⑥ 别名路径 @/ + 父目录名对上 ⇒ 红', files: { 'w/x/i.ts': "import { N } from '@/components/chat/gone-banner'\n", 'components/chat/gone-banner.tsx': 'export const N = 1' }, del: ['components/chat/gone-banner.tsx'], want: 'red' },
    { name: '⑦ 同名文件已在别的目录存续(= 已迁移)⇒ 不判红', files: { 'a/i.ts': "import { f } from './gone-moved'\n", 'b/gone-moved.ts': 'export const f = 1', 'a/gone-moved.ts': 'export const f = 1' }, del: ['a/gone-moved.ts'], want: 'alternative-path' },
    { name: '⑧ 唯一引用方落在夹具/产物目录 ⇒ 不判红', files: { 'src/gone-fixture.ts': 'export const f = 1', 'dist/bundle.js': "require('../src/gone-fixture')", 'testdata/gone-fixture.helper.ts': "from '../src/gone-fixture'" }, del: ['src/gone-fixture.ts'], want: 'no-reference' },
    { name: '⑨ 唯一引用方在 baseline 记账 JSON ⇒ 不判红', files: { 'x/gone-tool.mjs': 'export const a = 1', 'scripts/gone-baseline.json': '{"x/gone-tool.mjs":3}' }, del: ['x/gone-tool.mjs'], want: 'no-reference' },
    { name: '⑩ 只有 .md 提到 ⇒ 文档叙述不算依赖', files: { 'docs/gone-doc.md': 'see src/util/gone-utils.ts and gone-utils', 'src/util/gone-utils.ts': 'export const a = 1' }, del: ['src/util/gone-utils.ts'], want: 'no-reference' },
    { name: '⑪ 注释里的示例 import ⇒ 不判(防假红第一道)', files: { 'a/i.ts': "// import { f } from './gone-commented'\nexport const k = 1\n", 'a/gone-commented.ts': 'export const f = 1' }, del: ['a/gone-commented.ts'], want: 'no-reference' },
    { name: '⑫ 相对说明符另有同名现存目标(歧义)⇒ 放过', files: { 'a/i.ts': "import { f } from './gone-ambig'\n", 'a/gone-ambig/index.ts': 'export const f = 1', 'a/gone-ambig.ts': 'export const f = 1' }, del: ['a/gone-ambig.ts'], want: 'no-reference' },
    { name: '⑬ 外部包同名(react/jsx-runtime 型)⇒ 父目录对不上,不判', files: { 'a/i.ts': "import { r } from 'react/jsx-runtime'\n", 'src/theme/jsx-runtime.ts': 'export const r = 1' }, del: ['src/theme/jsx-runtime.ts'], want: 'no-reference' },
    { name: '⑭ 名字过短 ⇒ 判据不可用,如实报 undetermined(不静默)', files: { 'a/i.ts': "import { f } from './qq'\n", 'a/qq.ts': 'export const f = 1' }, del: ['a/qq.ts'], want: 'undetermined' },
    { name: '⑮ 候选面过大 ⇒ undetermined 而非判红', files: { 'a/i.ts': "import { f } from './gone-wide'\n", 'a/gone-wide.ts': 'export const f = 1' }, del: ['a/gone-wide.ts'], want: 'undetermined', wide: true },
    { name: '⑯ 豁免清单精确命中 ⇒ 只报数', files: { 'a/i.ts': "import { f } from './gone-exempt'\n", 'a/gone-exempt.ts': 'export const f = 1' }, del: ['a/gone-exempt.ts'], want: 'allowlisted', allow: [{ pattern: 'a/gone-exempt.ts', reason: '测试豁免' }] },
    { name: '⑰ 豁免清单目录前缀 a/** ⇒ 只报数', files: { 'a/i.ts': "import { f } from './gone-exempt2'\n", 'a/gone-exempt2.ts': 'export const f = 1' }, del: ['a/gone-exempt2.ts'], want: 'allowlisted', allow: [{ pattern: 'a/**', reason: '整目录有意删除' }] },
    { name: '⑱ 无任何引用 ⇒ no-reference', files: { 'z/gone-solo.ts': 'export const a = 1', 'q/other.ts': 'export const b = 1' }, del: ['z/gone-solo.ts'], want: 'no-reference' },
    { name: '⑲ JSON 配置(tsconfig include)引用也算依赖 ⇒ 红', files: { 'tsconfig.x.json': '{"include":["./src/gone-mod.ts"]}', 'src/gone-mod.ts': 'export const a = 1' }, del: ['src/gone-mod.ts'], want: 'red' },
    { name: '⑳ 生成物里的引用不算存续性证据', files: { 'src/a/i.gen.ts': "export * from './gone-gen'", 'src/a/gone-gen.ts': 'export const a = 1' }, del: ['src/a/gone-gen.ts'], want: 'no-reference' },
    { name: '㉑ 动态 import() 形式也算引用 ⇒ 红', files: { 'a/i.ts': "const m = await import('./gone-dyn')\n", 'a/gone-dyn.ts': 'export const f = 1' }, del: ['a/gone-dyn.ts'], want: 'red' },
    { name: '㉒ TS 的 ./x.js 写法指向被删的 x.ts ⇒ 红', files: { 'a/i.ts': "import { f } from './gone-jsform.js'\n", 'a/gone-jsform.ts': 'export const f = 1' }, del: ['a/gone-jsform.ts'], want: 'red' },
    { name: '㉓ 测试夹具目录(__tests__ 是真测试,不是夹具)⇒ 仍算引用方 ⇒ 红', files: { 'a/__tests__/gone-real.test.ts': "import { f } from '../gone-real'\n", 'a/gone-real.ts': 'export const f = 1' }, del: ['a/gone-real.ts'], want: 'red' },
  ]
  let fail = 0
  for (const c of cases) {
    let r
    if (c.wide) {
      const live = Object.keys(c.files).filter((p) => !c.del.includes(p))
      r = auditDeletions(c.del, {
        livePaths: live,
        readFile: (p) => (p in c.files ? c.files[p] : null),
        getCandidates: () => Array.from({ length: MAX_CANDIDATES + 1 }, (_, i) => `bulk/gone-wide${i}.ts`),
        allow: [],
      })[0]
    } else r = run(c.files, c.del, c.allow)
    const ok = r && r.verdict === c.want
    if (!ok) fail++
    console.log(`${ok ? '✅' : '❌'} ${c.name} → ${r ? r.verdict : 'n/a'}(期望 ${c.want})`)
  }
  const unit = [
    ['stemOf 只剥最后一个扩展名', stemOf('a/b/c.input-notices.ts') === 'c.input-notices'],
    ['joinRel 处理 ..', joinRel('a/b', '../c/d.ts') === 'a/c/d.ts'],
    ['joinRel 逃出仓库根返回 null', joinRel('a', '../../x') === null],
    ['moduleCandidates 认 TS 的 .js 写法', moduleCandidates('a/x.js').includes('a/x.ts')],
    ['classifySpecifier 拒收 URL', classifySpecifier('https://x/gone-a.ts', 'a.ts', 'gone-a.ts', new Set()) === null],
    ['classifySpecifier 拒收裸包名', classifySpecifier('gone-a', 'a.ts', 'x/gone-a.ts', new Set()) === null],
    ['matchAllowlist 认目录前缀', !!matchAllowlist('p/q/r.ts', [{ pattern: 'p/q/**', reason: '' }])],
    ['parseAllowlist 缺文件不报错也不放行', parseAllowlist(null, 'x').entries.length === 0 && !parseAllowlist(null, 'x').parseError],
    ['parseAllowlist 坏 JSON 必须显式报错', !!parseAllowlist('{oops', 'x').parseError],
    ['codeLines 剥整行 // 与 * 注释', !/ghost-module/.test(codeLines("// from './ghost-module'\n * x\nexport const a = 1", 'a.ts'))],
  ]
  for (const [name, ok] of unit) {
    if (!ok) fail++
    console.log(`${ok ? '✅' : '❌'} ${name}`)
  }
  console.log(fail ? `❌ 自检失败 ${fail} 项` : `✅ 全部 ${cases.length + unit.length} 项通过(正反成对)`)
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
  codeLines,
  extractStrings,
  classifySpecifier,
  referencesFor,
  matchAllowlist,
  parseAllowlist,
  auditDeletions,
  grepFiles,
  readIndexBlobs,
  collectDeletions,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
